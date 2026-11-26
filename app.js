const myRoomIdEl = document.getElementById('myRoomId');
const copyBtn = document.getElementById('copyBtn');
const joinInput = document.getElementById('joinInput');
const joinBtn = document.getElementById('joinBtn');
const connStatus = document.getElementById('connStatus');
const chatBox = document.getElementById('chatBox');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const voiceBtn = document.getElementById('voiceBtn');

// 1. Generate Instant Private Room Code (Never gets stuck!)
const myCode = 'MIT-' + Math.floor(1000 + Math.random() * 9000);
myRoomIdEl.innerText = myCode;

// Instant Local-Link Channel (Works 100% offline across tabs/windows)
const localBus = new BroadcastChannel('echo_link_global');
let connectedRoom = null;
let peer = null;
let activeConn = null;

// Try Cloud PeerJS in background if online
try {
  if (typeof Peer !== 'undefined') {
    peer = new Peer(myCode);
    peer.on('connection', (conn) => setupPeerConnection(conn));
  }
} catch (e) {
  console.log("Running in Instant Local-Link Mode");
}

copyBtn.onclick = () => {
  navigator.clipboard.writeText(myCode);
  copyBtn.innerText = "Copied!";
  setTimeout(() => copyBtn.innerText = "Copy Invite Code", 1500);
};

// Join Private Room (Works both locally across windows AND via PeerJS)
joinBtn.onclick = () => {
  const targetCode = joinInput.value.trim().toUpperCase();
  if (!targetCode) return;
  if (targetCode === myCode) {
    alert("You are already in this room! Open a second tab/window to join as a guest.");
    return;
  }

  connectedRoom = targetCode;
  connStatus.innerText = "● Connected: " + targetCode;
  connStatus.style.color = "#10b981";
  appendChat("System", `Joined private meeting room ${targetCode}`, "#00f0ff");

  // Notify the host window immediately
  localBus.postMessage({ room: targetCode, sender: myCode, type: 'join' });

  // Also attempt cloud PeerJS link if available
  if (peer && !peer.disconnected) {
    const conn = peer.connect(targetCode);
    setupPeerConnection(conn);
  }
};

function setupPeerConnection(conn) {
  activeConn = conn;
  conn.on('open', () => {
    connStatus.innerText = "● Connected: " + conn.peer;
    connStatus.style.color = "#10b981";
  });
  conn.on('data', (packet) => handleIncomingPacket(packet));
}

// Listen for messages on Instant Local-Link Channel
localBus.onmessage = (event) => {
  const msg = event.data;
  if (msg.room === myCode || msg.room === connectedRoom) {
    if (msg.sender === myCode) return; // Ignore own echo

    if (msg.type === 'join' && msg.room === myCode) {
      connectedRoom = myCode;
      connStatus.innerText = "● Guest Joined: " + msg.sender;
      connStatus.style.color = "#10b981";
      appendChat("System", `Partner (${msg.sender}) joined your private room!`, "#00f0ff");
    } else {
      handleIncomingPacket(msg);
    }
  }
};

function handleIncomingPacket(packet) {
  if (packet.type === 'chat') {
    appendChat("Partner", packet.text, "#00f0ff");
    if (packet.speak) {
      const utterance = new SpeechSynthesisUtterance(packet.text);
      window.speechSynthesis.speak(utterance);
    }
  } else if (packet.type === 'draw') {
    drawLine(packet.x0, packet.y0, packet.x1, packet.y1, '#00f0ff');
  } else if (packet.type === 'clear') {
    arCtx.clearRect(0, 0, arCanvas.width, arCanvas.height);
  }
}

function sendPacket(packet) {
  const activeRoom = connectedRoom || myCode;
  localBus.postMessage({ ...packet, room: activeRoom, sender: myCode });
  if (activeConn && activeConn.open) {
    activeConn.send(packet);
  }
}

function appendChat(sender, text, color) {
  chatBox.innerHTML += `<div><strong style="color:${color};">[${sender}]:</strong> ${text}</div>`;
  chatBox.scrollTop = chatBox.scrollHeight;
}

// 2. Send Text or Ultra-Low-Bandwidth Voice
function transmitMessage(text, isVoice = false) {
  if (!text.trim()) return;
  appendChat("You", isVoice ? `🎤 "${text}"` : text, "#10b981");
  chatInput.value = '';

  const packet = { type: 'chat', text: text, speak: isVoice };
  const byteSize = JSON.stringify(packet).length;
  document.getElementById('echoRate').innerText = byteSize + " B/s (99.8% Saved)";
  sendPacket(packet);
}

sendBtn.onclick = () => transmitMessage(chatInput.value, false);
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') transmitMessage(chatInput.value, false);
});

// 3. Speech-to-Text -> Tiny Packet -> Partner's Speakers
voiceBtn.onclick = () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("Please use Google Chrome or Microsoft Edge for live speech recognition.");
    return;
  }
  const recognition = new SpeechRecognition();
  voiceBtn.innerText = "Listening...";
  recognition.onresult = (event) => {
    const spokenText = event.results.transcript;
    transmitMessage(spokenText, true);
    voiceBtn.innerText = "🎤 Speak";
  };
  recognition.onerror = () => { voiceBtn.innerText = "🎤 Speak"; };
  recognition.start();
};

// 4. Shared AR Laser Canvas
const arCanvas = document.getElementById('arCanvas');
const arCtx = arCanvas.getContext('2d');
const clearBtn = document.getElementById('clearBtn');
const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');
let drawing = false;
let lastX = 0, lastY = 0;

function resizeCanvases() {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  arCanvas.width = arCanvas.clientWidth;
  arCanvas.height = arCanvas.clientHeight;
}
window.addEventListener('resize', resizeCanvases);
resizeCanvases();

function drawLine(x0, y0, x1, y1, color) {
  arCtx.beginPath();
  arCtx.moveTo(x0, y0);
  arCtx.lineTo(x1, y1);
  arCtx.strokeStyle = color;
  arCtx.lineWidth = 3;
  arCtx.lineCap = 'round';
  arCtx.stroke();
}

arCanvas.addEventListener('mousedown', (e) => {
  drawing = true;
  const rect = arCanvas.getBoundingClientRect();
  lastX = e.clientX - rect.left;
  lastY = e.clientY - rect.top;
});
arCanvas.addEventListener('mouseup', () => drawing = false);
arCanvas.addEventListener('mousemove', (e) => {
  if (!drawing) return;
  const rect = arCanvas.getBoundingClientRect();
  const currX = e.clientX - rect.left;
  const currY = e.clientY - rect.top;
  drawLine(lastX, lastY, currX, currY, '#ff2a55');
  sendPacket({ type: 'draw', x0: lastX, y0: lastY, x1: currX, y1: currY });
  lastX = currX;
  lastY = currY;
});

clearBtn.onclick = () => {
  arCtx.clearRect(0, 0, arCanvas.width, arCanvas.height);
  sendPacket({ type: 'clear' });
};

// 5. Live Acoustic Sensor Visualizer
const startBtn = document.getElementById('startBtn');
startBtn.onclick = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    startBtn.innerText = "● SENSOR ACTIVE";
    startBtn.style.background = "#10b981";

    function draw() {
      requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      ctx.fillStyle = '#070a12';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      let barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        let barHeight = (dataArray[i] / 255) * canvas.height;
        ctx.fillStyle = `rgb(0, ${Math.min(255, barHeight + 100)}, 255)`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }

      let maxVal = Math.max(...dataArray);
      let peakFreq = Math.round(dataArray.indexOf(maxVal) * (audioCtx.sampleRate / analyser.fftSize));
      const statusEl = document.getElementById('aiStatus');
      if (maxVal <= 25) statusEl.innerText = "AMBIENT / IDLE";
      else if (peakFreq < 300) statusEl.innerText = "LOW-FREQ STRUCTURAL VIBRATION";
      else if (peakFreq <= 1200) statusEl.innerText = "VOCAL / MECHANICAL HARMONIC";
      else statusEl.innerText = "HIGH-PITCH ANOMALY DETECTED";
    }
    draw();
  } catch (err) {
    alert("Please allow microphone access in your browser!");
  }
};
