export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private onDataCallback: ((audioBlob: Blob) => void) | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private vadCheckInterval: number | null = null;
  private isSpeaking: boolean = false;
  private silenceStart: number | null = null;
  private speechStart: number | null = null;
  private isActive: boolean = false; // Track if we should continue recording
  private readonly SILENCE_THRESHOLD = 0.01; // Volume threshold for silence
  private readonly SILENCE_DURATION = 1500; // ms of silence before stopping
  private readonly MIN_SPEECH_DURATION = 500; // ms minimum speech before considering it valid

  async start(onData: (audioBlob: Blob) => void) {
    try {
      console.log('AudioRecorder.start() called');
      this.isActive = true;
      this.onDataCallback = onData;
      
      console.log('Requesting microphone access...');
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      console.log('Microphone access granted, stream:', this.stream);

      // Set up audio analysis for VAD
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      source.connect(this.analyser);
      console.log('Audio analyser created for VAD');

      const mimeType = 'audio/webm;codecs=opus';
      console.log('Creating MediaRecorder with mimeType:', mimeType);
      console.log('MediaRecorder supported:', MediaRecorder.isTypeSupported(mimeType));
      
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: mimeType
      });
      console.log('MediaRecorder created, state:', this.mediaRecorder.state);

      this.mediaRecorder.ondataavailable = (event) => {
        console.log('ondataavailable fired, data size:', event.data.size);
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          console.log('Audio chunk added, total chunks:', this.audioChunks.length);
        }
      };

      this.mediaRecorder.onstop = () => {
        console.log('MediaRecorder onstop fired, chunks:', this.audioChunks.length);
        if (this.audioChunks.length > 0) {
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          console.log('Created audio blob, size:', audioBlob.size);
          this.onDataCallback?.(audioBlob);
          this.audioChunks = [];
          
          // Restart recording only if we're still actively listening
          if (this.isActive && this.mediaRecorder && this.stream && this.vadCheckInterval) {
            console.log('Restarting MediaRecorder for next utterance...');
            this.mediaRecorder.start();
          }
        } else {
          console.warn('No audio chunks available in onstop');
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
      };

      // Start continuous recording
      console.log('Starting MediaRecorder...');
      this.mediaRecorder.start();
      console.log('MediaRecorder started, state:', this.mediaRecorder.state);
      
      // Start VAD monitoring
      this.startVAD();
      console.log('Audio recorder started with VAD');
    } catch (error) {
      console.error('Error starting audio recorder:', error);
      throw error;
    }
  }

  private startVAD() {
    console.log('Starting VAD monitoring...');
    this.vadCheckInterval = window.setInterval(() => {
      if (!this.analyser) return;

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      this.analyser.getByteTimeDomainData(dataArray);

      // Calculate RMS (volume)
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const normalized = (dataArray[i] - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / bufferLength);

      const now = Date.now();
      
      if (rms > this.SILENCE_THRESHOLD) {
        // Speech detected
        if (!this.isSpeaking) {
          console.log('Speech started, RMS:', rms);
          this.isSpeaking = true;
          this.speechStart = now;
        }
        this.silenceStart = null;
      } else {
        // Silence detected
        if (this.isSpeaking && !this.silenceStart) {
          console.log('Silence started');
          this.silenceStart = now;
        }

        // Check if silence duration exceeded and we have valid speech
        if (this.isSpeaking && this.silenceStart && this.speechStart) {
          const silenceDuration = now - this.silenceStart;
          const speechDuration = this.silenceStart - this.speechStart;
          
          if (silenceDuration >= this.SILENCE_DURATION && speechDuration >= this.MIN_SPEECH_DURATION) {
            console.log(`Speech ended after ${speechDuration}ms, silence for ${silenceDuration}ms`);
            this.processRecording();
          }
        }
      }
    }, 100); // Check every 100ms
  }

  private processRecording() {
    console.log('Processing recording due to VAD...');
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
      // Reset VAD state
      this.isSpeaking = false;
      this.silenceStart = null;
      this.speechStart = null;
    }
  }

  stop() {
    console.log('AudioRecorder.stop() called');
    this.isActive = false; // Prevent restart
    
    // Stop VAD monitoring
    if (this.vadCheckInterval) {
      clearInterval(this.vadCheckInterval);
      this.vadCheckInterval = null;
    }
    
    // Stop media recorder
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      console.log('Stopping MediaRecorder...');
      this.mediaRecorder.stop();
    }
    
    // Stop audio context
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    // Stop stream
    if (this.stream) {
      console.log('Stopping stream tracks...');
      this.stream.getTracks().forEach(track => {
        console.log('Stopping track:', track.kind, track.label);
        track.stop();
      });
    }
    
    this.audioChunks = [];
    this.analyser = null;
    this.isSpeaking = false;
    this.silenceStart = null;
    this.speechStart = null;
    console.log('Audio recorder stopped');
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }
}

export const playAudioFromBase64 = async (base64Audio: string) => {
  try {
    const audioBlob = new Blob(
      [Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0))],
      { type: 'audio/mpeg' }
    );
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    
    await audio.play();
    
    // Cleanup
    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
    };

    return audio;
  } catch (error) {
    console.error('Error playing audio:', error);
    throw error;
  }
};
