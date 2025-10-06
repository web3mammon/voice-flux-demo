export class AudioQueue {
  private queue: string[] = [];
  private isPlaying = false;
  private currentAudio: HTMLAudioElement | null = null;
  private onPlaybackComplete?: () => void;

  constructor(onPlaybackComplete?: () => void) {
    this.onPlaybackComplete = onPlaybackComplete;
  }

  async addChunk(audioBase64: string) {
    console.log('Adding audio chunk to queue');
    this.queue.push(audioBase64);
    
    if (!this.isPlaying) {
      await this.playNext();
    }
  }

  private async playNext() {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      this.onPlaybackComplete?.();
      console.log('Audio queue complete');
      return;
    }

    this.isPlaying = true;
    const audioBase64 = this.queue.shift()!;

    try {
      const audioBlob = new Blob(
        [Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0))],
        { type: 'audio/mpeg' }
      );
      const audioUrl = URL.createObjectURL(audioBlob);
      
      this.currentAudio = new Audio(audioUrl);
      
      await this.currentAudio.play();
      
      this.currentAudio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        this.playNext();
      };

      this.currentAudio.onerror = (error) => {
        console.error('Audio playback error:', error);
        URL.revokeObjectURL(audioUrl);
        this.playNext();
      };
    } catch (error) {
      console.error('Error playing audio chunk:', error);
      this.playNext();
    }
  }

  stop() {
    this.currentAudio?.pause();
    this.currentAudio = null;
    this.queue = [];
    this.isPlaying = false;
  }

  clear() {
    this.stop();
  }
}
