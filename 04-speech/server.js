const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const speech = require('@google-cloud/speech');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files
app.use(express.static('public'));

const speechClient = new speech.SpeechClient();

wss.on('connection', function(ws) {
    console.log('New client connected');
    
    let recognizeStream = null;
    let lastSpeechTime = Date.now();
    let currentTranscript = '';
    const SILENCE_THRESHOLD_MS = 2000;

    const config = {
        config: {
            encoding: 'LINEAR16',
            sampleRateHertz: 16000,
            languageCode: 'th-TH',
            alternativeLanguageCodes: ['en-US']
        },
        interimResults: true,
        singleUtterance: false
    };

    ws.on('message', function(message) {
        try {
            // Check if message is binary (audio data) or text (configuration)
            if (message instanceof Buffer) {
                // Handle audio data
                if (recognizeStream) {
                    recognizeStream.write(message);
                }
            } else {
                // Handle text message (configuration)
                const constraints = JSON.parse(message);
                console.log('Got sampleRate:', constraints.sampleRate);

                // Create recognize stream
                recognizeStream = speechClient
                    .streamingRecognize(config)
                    .on('error', console.error)
                    .on('data', (data) => {
                        lastSpeechTime = Date.now();
                        
                        if (data.results[0] && data.results[0].alternatives[0]) {
                            const transcript = data.results[0].alternatives[0].transcript;
                            
                            if (data.results[0].isFinal) {
                                currentTranscript += transcript + ' ';
                                
                                // Call third party API when we have final result
                                callThirdPartyApi(currentTranscript.trim())
                                    .then(response => {
                                        ws.send(JSON.stringify({
                                            type: 'bot',
                                            content: response
                                        }));
                                        currentTranscript = '';
                                    });
                            }

                            // Send transcription to client
                            ws.send(JSON.stringify({
                                type: 'user',
                                content: data.results[0]
                            }));
                        }
                    });
            }
        } catch (error) {
            console.error('Error:', error);
        }
    });

    // Check for silence periodically
    const silenceCheck = setInterval(() => {
        if (Date.now() - lastSpeechTime > SILENCE_THRESHOLD_MS && currentTranscript) {
            callThirdPartyApi(currentTranscript.trim())
                .then(response => {
                    ws.send(JSON.stringify({
                        type: 'bot',
                        content: response
                    }));
                    currentTranscript = '';
                });
        }
    }, 1000);

    ws.on('close', () => {
        console.log('Client disconnected');
        if (recognizeStream) {
            recognizeStream.destroy();
        }
        clearInterval(silenceCheck);
    });
});

async function callThirdPartyApi(message) {
    try {
        // TODO: Implement actual API call
        // const response = await axios.post('YOUR_API_ENDPOINT', { message });
        // return response.data;
        
        return `This is response from third party API for: ${message}`;
    } catch (error) {
        console.error('Error calling third party API:', error);
        return "Sorry, I couldn't process that.";
    }
}

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 