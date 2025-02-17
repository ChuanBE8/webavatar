import { useEffect, useState, useRef } from 'react';
import styles from '../styles/Home.module.css';

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const socketRef = useRef(null);
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const scriptNodeRef = useRef(null);

  useEffect(() => {
    if (!window.AudioContext) {
      alert("Web Audio isn't available in your browser.");
      return;
    }
    audioContextRef.current = new AudioContext();
    return () => audioContextRef.current?.close();
  }, []);

  const initWebSocket = async () => {
    try {
      // Check if browser supports getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser API not supported');
      }

      // Request permission and access to microphone
      const audioPromise = navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          channelCount: 1,
          sampleRate: { ideal: 16000 },
          sampleSize: 16
        }
      });

      const stream = await audioPromise;
      
      // Check if we're running in HTTPS or localhost
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        throw new Error('getUserMedia() must be run from a secure origin: HTTPS or localhost');
      }

      const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      socketRef.current = new WebSocket(`${wsProtocol}//${location.hostname}:8080`);

      socketRef.current.onopen = () => {
        socketRef.current.send(JSON.stringify({ 
          sampleRate: audioContextRef.current.sampleRate 
        }));
      };

      socketRef.current.onmessage = (event) => {
        const result = JSON.parse(event.data);
        if (result.type === 'user') {
          setTranscript(prev => [...prev, { 
            type: 'user', 
            text: result.content.alternatives[0]?.transcript || '' 
          }]);
        } else if (result.type === 'bot') {
          setTranscript(prev => [...prev, { 
            type: 'bot', 
            text: result.content 
          }]);
        }
      };

      // Set up audio processing
      sourceNodeRef.current = audioContextRef.current.createMediaStreamSource(stream);
      scriptNodeRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      const MAX_INT = Math.pow(2, 16 - 1) - 1;
      scriptNodeRef.current.onaudioprocess = (e) => {
        const floatSamples = e.inputBuffer.getChannelData(0);
        socketRef.current?.send(Int16Array.from(floatSamples.map(n => n * MAX_INT)));
      };

      sourceNodeRef.current.connect(scriptNodeRef.current);
      scriptNodeRef.current.connect(audioContextRef.current.destination);

      return true;
    } catch (error) {
      console.error('Error initializing:', error);
      alert(`Error: ${error.message || 'Could not access microphone'}`);
      setIsRecording(false);
      return false;
    }
  };

  const toggleRecording = async () => {
    if (!isRecording) {
      const success = await initWebSocket();
      if (success !== false) { // Only proceed if initialization was successful
        await audioContextRef.current.resume();
        setIsRecording(true);
      }
    } else {
      socketRef.current?.close();
      sourceNodeRef.current?.disconnect();
      scriptNodeRef.current?.disconnect();
      await audioContextRef.current.suspend();
      setIsRecording(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1>Speech to Text</h1>
      
      <button 
        onClick={toggleRecording}
        className={`${styles.button} ${isRecording ? styles.recording : ''}`}
      >
        {isRecording ? 'Stop' : 'Start'} Recording
      </button>

      <div className={styles.transcript}>
        {transcript.map((item, index) => (
          <div 
            key={index} 
            className={`${styles.message} ${
              item.type === 'bot' ? styles.botMessage : styles.userMessage
            }`}
          >
            {item.text}
          </div>
        ))}
      </div>
    </div>
  );
} 