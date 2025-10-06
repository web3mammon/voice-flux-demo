export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private onDataCallback: ((audioBlob: Blob) => void) | null = null;

  async start(onData: (audioBlob: Blob) => void) {
    try {
      this.onDataCallback = onData;
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });

      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        if (this.audioChunks.length > 0) {
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          this.onDataCallback?.(audioBlob);
          this.audioChunks = [];
        }
      };

      // Collect audio in 2-second chunks for VAD
      this.mediaRecorder.start(2000);
      console.log('Audio recorder started');
    } catch (error) {
      console.error('Error starting audio recorder:', error);
      throw error;
    }
  }

  stop() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
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
