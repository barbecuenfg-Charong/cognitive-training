import argparse
import json
import urllib.request
import urllib.error
import sys
import os
from pathlib import Path

# Configuration
# Assuming this script is in the project-port-manager directory
CURRENT_DIR = Path(__file__).parent.absolute()
CONFIG_FILE_NAME = "config.json"
CONFIG_PATH = CURRENT_DIR / CONFIG_FILE_NAME
API_URL = "http://127.0.0.1:5555/projects"

def register_via_api(project_data):
    """Attempt to register the project via the running API."""
    print(f"Attempting to register via API at {API_URL}...")
    try:
        req = urllib.request.Request(
            API_URL,
            data=json.dumps(project_data).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        with urllib.request.urlopen(req) as f:
            response = f.read().decode('utf-8')
            print(f"✅ Successfully registered via API.")
            return True
    except urllib.error.URLError as e:
        print(f"⚠️ API registration failed (Service might be down): {e}")
        return False
    except Exception as e:
        print(f"⚠️ API registration error: {e}")
        return False

def register_via_file(project_data):
    """Fallback method: Register by directly modifying config.json."""
    print(f"Attempting to register via direct file modification: {CONFIG_PATH}...")
    
    # 1. Load existing config
    if not CONFIG_PATH.exists():
        print("config.json not found, creating new one.")
        config = {"projects": []}
    else:
        try:
            content = CONFIG_PATH.read_text(encoding='utf-8')
            if not content.strip():
                config = {"projects": []}
            else:
                config = json.loads(content)
        except json.JSONDecodeError as e:
            print(f"❌ Error: config.json is corrupted: {e}")
            return False
        except Exception as e:
            print(f"❌ Error reading config.json: {e}")
            return False

    # 2. Update or Append
    projects = config.get("projects", [])
    existing_idx = -1
    
    for i, p in enumerate(projects):
        if p.get("id") == project_data.get("id"):
            existing_idx = i
            break
    
    if existing_idx >= 0:
        projects[existing_idx] = project_data
        print(f"Updated existing project entry: {project_data.get('id')}")
    else:
        projects.append(project_data)
        print(f"Added new project entry: {project_data.get('id')}")
    
    config["projects"] = projects

    # 3. Save
    try:
        CONFIG_PATH.write_text(json.dumps(config, indent=2, ensure_ascii=False), encoding='utf-8')
        print("✅ Successfully registered via file modification.")
        return True
    except Exception as e:
        print(f"❌ Error writing config.json: {e}")
        return False

def validate_project_data(data):
    """Simple validation of the project data structure."""
    required_fields = ["id", "name", "root_path", "services"]
    for field in required_fields:
        if field not in data:
            print(f"❌ Validation Error: Missing required field '{field}'")
            return False
    
    if not isinstance(data["services"], list):
        print("❌ Validation Error: 'services' must be a list")
        return False
        
    return True

def main():
    parser = argparse.ArgumentParser(description="Register a project with Port Manager")
    parser.add_argument("config_file", help="Path to the JSON file containing the project configuration")
    
    args = parser.parse_args()
    input_path = Path(args.config_file)
    
    if not input_path.exists():
        print(f"❌ Error: Input file not found: {input_path}")
        sys.exit(1)
        
    try:
        project_data = json.loads(input_path.read_text(encoding='utf-8'))
    except Exception as e:
        print(f"❌ Error: Failed to parse input JSON: {e}")
        sys.exit(1)

    if not validate_project_data(project_data):
        sys.exit(1)

    # Try API first, then File
    if not register_via_api(project_data):
        if not register_via_file(project_data):
            print("❌ Registration failed.")
            sys.exit(1)

if __name__ == "__main__":
    main()
