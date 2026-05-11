document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('toggle-btn');
    const stopBtn = document.getElementById('stop-btn');
    const statusText = document.getElementById('status-text');
    const micIcon = document.getElementById('mic-icon');
    const transcriptDisplay = document.getElementById('transcript');
    const volumeBar = document.getElementById('volume-bar');
    
    let isListening = false;
    let recognition = null;
    let audioContext = null;
    let analyser = null;
    let microphone = null;
    let javascriptNode = null;
    let mediaStream = null;
    
    // Electron detection
    const isElectron = /Electron/.test(navigator.userAgent);

    toggleBtn.addEventListener('click', toggleTest);

    function renderTranscript(finalTranscript, interimTranscript) {
        transcriptDisplay.textContent = "";
        const finalSpan = document.createElement("span");
        finalSpan.style.color = "#2c3e50";
        finalSpan.textContent = finalTranscript;
        const interimSpan = document.createElement("span");
        interimSpan.style.color = "#95a5a6";
        interimSpan.textContent = interimTranscript;
        transcriptDisplay.appendChild(finalSpan);
        transcriptDisplay.appendChild(interimSpan);
    }

    function renderElectronOpenHint() {
        statusText.textContent = "";
        statusText.append("网络错误：桌面版缺少语音API密钥。");
        statusText.appendChild(document.createElement("br"));

        const link = document.createElement("a");
        link.href = "#";
        link.textContent = "在系统浏览器中打开";
        link.addEventListener("click", (event) => {
            event.preventDefault();
            try {
                window.electronShell.openPath(window.location.href);
            } catch (_error) {
                // Keep silent on non-electron runtime.
            }
        });
        statusText.appendChild(link);
    }

    function toggleTest() {
        if (isListening) {
            stopTest();
        } else {
            startTest();
        }
    }

    function startTest() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert("您的浏览器不支持语音识别，请使用 Chrome 或 Edge 浏览器。");
            return;
        }

        toggleBtn.textContent = "停止测试";
        toggleBtn.classList.remove('primary');
        toggleBtn.classList.add('secondary');
        isListening = true;
        
        // 1. Start Speech Recognition
        startRecognition();
        
        // 2. Start Audio Visualizer (Volume Meter)
        startAudioContext();
    }

    function stopTest(options = {}) {
        toggleBtn.textContent = "开始测试";
        toggleBtn.style.display = 'inline-block';
        stopBtn.style.display = 'none';
        toggleBtn.classList.remove('secondary');
        toggleBtn.classList.add('primary');
        isListening = false;
        
        if (recognition) {
            recognition.stop();
            recognition = null;
        }
        
        if (audioContext) {
            audioContext.close();
            audioContext = null;
        }
        
        micIcon.classList.remove('active');
        if (!options.keepStatus) {
            statusText.textContent = "测试已停止";
        }
        volumeBar.style.width = "0%";
    }

    function startRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.lang = 'zh-CN';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onstart = () => {
            statusText.textContent = "正在聆听... 请说话";
            micIcon.classList.add('active');
        };

        recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            renderTranscript(finalTranscript, interimTranscript);
        };

        recognition.onerror = (event) => {
            console.error("Speech error", event.error);
            let msg = "错误: " + event.error;
            
            if (event.error === 'not-allowed') {
                msg = "麦克风权限被拒绝。请在浏览器设置中允许访问。";
                alert(msg);
                stopTest();
            } else if (event.error === 'service-not-allowed') {
                msg = "当前浏览器不支持语音识别服务，请使用 Chrome 或 Edge 浏览器。";
                alert(msg);
                stopTest();
            } else if (event.error === 'network' && isElectron) {
                renderElectronOpenHint();
                stopTest({ keepStatus: true });
                return; // Avoid overwriting statusText below
            }
            
            statusText.textContent = msg;
        };

        recognition.onend = () => {
            if (isListening) {
                try {
                    recognition.start();
                } catch(e) {
                    // Ignore
                }
            }
        };

        try {
            recognition.start();
        } catch (e) {
            console.error(e);
        }
    }

    function startAudioContext() {
        navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            .then(stream => {
                mediaStream = stream;
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                analyser = audioContext.createAnalyser();
                microphone = audioContext.createMediaStreamSource(stream);
                javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);

                analyser.smoothingTimeConstant = 0.8;
                analyser.fftSize = 1024;

                microphone.connect(analyser);
                analyser.connect(javascriptNode);
                javascriptNode.connect(audioContext.destination);

                javascriptNode.onaudioprocess = () => {
                    const array = new Uint8Array(analyser.frequencyBinCount);
                    analyser.getByteFrequencyData(array);
                    let values = 0;
                    const length = array.length;
                    for (let i = 0; i < length; i++) {
                        values += array[i];
                    }
                    const average = values / length;
                    
                    // Map average (0-100 usually) to percentage
                    // Amplify a bit for visibility
                    let percent = Math.min(100, average * 2);
                    volumeBar.style.width = percent + "%";
                };
            })
            .catch(err => {
                console.error("Audio context error", err);
                // Permission might be handled by recognition already, but this is double check
            });
    }
});
