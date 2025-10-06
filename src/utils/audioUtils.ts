export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private onDataCallback: ((audioBlob: Blob) => void) | null = null;

  async start(onData: (audioBlob: Blob) => void) {
    try {
      console.log('AudioRecorder.start() called');
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
        } else {
          console.warn('No audio chunks available in onstop');
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
      };

      // Collect audio in 2-second chunks for VAD
      console.log('Starting MediaRecorder with 2000ms timeslice...');
      this.mediaRecorder.start(2000);
      console.log('MediaRecorder started, state:', this.mediaRecorder.state);
      console.log('Audio recorder started');
    } catch (error) {
      console.error('Error starting audio recorder:', error);
      throw error;
    }
  }

  stop() {
    console.log('AudioRecorder.stop() called, mediaRecorder state:', this.mediaRecorder?.state);
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      console.log('Stopping MediaRecorder...');
      this.mediaRecorder.stop();
    }
    if (this.stream) {
      console.log('Stopping stream tracks...');
      this.stream.getTracks().forEach(track => {
        console.log('Stopping track:', track.kind, track.label);
        track.stop();
      });
    }
    this.audioChunks = [];
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
