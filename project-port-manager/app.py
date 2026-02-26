from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import List, Dict, Optional
from pathlib import Path
import json
import subprocess
import os
import socket


class ServiceConfig(BaseModel):
    id: str
    name: str
    type: str
    cwd: str
    command: str
    ports: List[int] = []


class ProjectConfig(BaseModel):
    id: str
    name: str
    root_path: str
    frontend_url: Optional[str] = None
    services: List[ServiceConfig]


class Config(BaseModel):
    projects: List[ProjectConfig] = []


def load_config() -> Config:
    path = Path(__file__).with_name("config.json")
    if not path.exists():
        return Config()
    data = json.loads(path.read_text(encoding="utf-8"))
    return Config(**data)


def save_config(new_config: Config):
    path = Path(__file__).with_name("config.json")
    if hasattr(new_config, "model_dump_json"):
        json_str = new_config.model_dump_json(indent=2)
    else:
        json_str = new_config.json(indent=2)
    path.write_text(json_str, encoding="utf-8")
    global config
    config = new_config


app = FastAPI(title="Project Port Manager")
config = load_config()
processes: Dict[str, subprocess.Popen] = {}


def is_port_open(port: int) -> bool:
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.2):
            return True
    except OSError:
        return False


def find_service(service_id: str) -> Optional[ServiceConfig]:
    for project in config.projects:
        for service in project.services:
            if service.id == service_id:
                return service
    return None


@app.get("/projects", response_model=List[ProjectConfig])
def list_projects() -> List[ProjectConfig]:
    return config.projects


@app.post("/projects", response_model=ProjectConfig)
def register_project(project: ProjectConfig):
    # Check if project ID already exists
    existing_idx = -1
    for i, p in enumerate(config.projects):
        if p.id == project.id:
            existing_idx = i
            break
    
    if existing_idx >= 0:
        config.projects[existing_idx] = project
    else:
        config.projects.append(project)
    
    save_config(config)
    return project


@app.delete("/projects/{project_id}")
def unregister_project(project_id: str):
    new_projects = [p for p in config.projects if p.id != project_id]
    if len(new_projects) == len(config.projects):
        raise HTTPException(status_code=404, detail="project not found")
    
    config.projects = new_projects
    save_config(config)
    return {"status": "unregistered", "project_id": project_id}


@app.get("/projects/{project_id}", response_model=ProjectConfig)
def get_project(project_id: str) -> ProjectConfig:
    for project in config.projects:
        if project.id == project_id:
            return project
    raise HTTPException(status_code=404, detail="project not found")


@app.get("/", response_class=HTMLResponse)
def index() -> str:
    path = Path(__file__).with_name("static").joinpath("index.html")
    if not path.exists():
        raise HTTPException(status_code=404, detail="index not found")
    return path.read_text(encoding="utf-8")


@app.get("/services/status")
def list_service_status():
    result = []
    for project in config.projects:
        for service in project.services:
            proc = processes.get(service.id)
            manager_running = proc is not None and proc.poll() is None
            port_occupied = False
            for port in service.ports:
                if is_port_open(port):
                    port_occupied = True
                    break
            running = manager_running or port_occupied
            pid = proc.pid if manager_running and proc is not None else None
            result.append(
                {
                    "project_id": project.id,
                    "service_id": service.id,
                    "name": service.name,
                    "type": service.type,
                    "running": running,
                    "pid": pid,
                    "ports": service.ports,
                    "manager_running": manager_running,
                    "port_occupied": port_occupied,
                }
            )
    return result


@app.post("/services/{service_id}/start")
def start_service(service_id: str):
    service = find_service(service_id)
    if service is None:
        raise HTTPException(status_code=404, detail="service not found")
    existing = processes.get(service_id)
    if existing is not None and existing.poll() is None:
        return {"status": "already_running", "pid": existing.pid}
    cwd = service.cwd if service.cwd else os.getcwd()
    proc = subprocess.Popen(service.command, shell=True, cwd=cwd)
    processes[service_id] = proc
    return {"status": "started", "pid": proc.pid}


@app.post("/services/{service_id}/stop")
def stop_service(service_id: str):
    proc = processes.get(service_id)
    if proc is None:
        # Check if the service has a port that is occupied, and if so, try to kill it
        service = find_service(service_id)
        if service:
            killed_any = False
            for port in service.ports:
                if is_port_open(port):
                    # Try to kill process on this port
                    if os.name == 'nt':
                        try:
                            # Find PID using netstat
                            cmd = f"netstat -ano | findstr :{port}"
                            output = subprocess.check_output(cmd, shell=True).decode()
                            for line in output.strip().split('\n'):
                                parts = line.strip().split()
                                # Check for LISTENING state and extract PID (last element)
                                if len(parts) >= 5 and 'LISTENING' in parts:
                                    local_addr = parts[1]
                                    if local_addr.endswith(f":{port}"):
                                        pid = parts[-1]
                                        if pid != '0' and pid != '4':
                                            subprocess.run(f"taskkill /F /PID {pid}", shell=True)
                                            killed_any = True
                        except Exception:
                            pass
            if killed_any:
                return {"status": "stopping_external"}

        return {"status": "not_running"}

    if proc.poll() is not None:
        return {"status": "not_running"}
    
    if os.name == 'nt':
        # On Windows, kill the entire process tree
        subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], shell=True)
    else:
        proc.terminate()
        
    return {"status": "stopping"}


@app.post("/projects/{project_id}/start")
def start_project(project_id: str):
    project = None
    for p in config.projects:
        if p.id == project_id:
            project = p
            break
    if project is None:
        raise HTTPException(status_code=404, detail="project not found")
    started = []
    for service in project.services:
        res = start_service(service.id)
        started.append({"service_id": service.id, "status": res.get("status"), "pid": res.get("pid")})
    return {"project_id": project_id, "services": started}


@app.post("/projects/{project_id}/stop")
def stop_project(project_id: str):
    project = None
    for p in config.projects:
        if p.id == project_id:
            project = p
            break
    if project is None:
        raise HTTPException(status_code=404, detail="project not found")
    stopped = []
    for service in project.services:
        res = stop_service(service.id)
        stopped.append({"service_id": service.id, "status": res.get("status")})
    return {"project_id": project_id, "services": stopped}
