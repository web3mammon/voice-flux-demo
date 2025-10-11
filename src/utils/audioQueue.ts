export class AudioQueue {
  private chunkBuffer: { [key: number]: string } = {}; // Indexed chunks
  private nextChunkToPlay = 0;
  private isPlaying = false;
  private currentAudio: HTMLAudioElement | null = null;
  private onPlaybackComplete?: () => void;

  constructor(onPlaybackComplete?: () => void) {
    this.onPlaybackComplete = onPlaybackComplete;
  }

  async addChunk(audioBase64: string, chunkIndex: number = 0) {
    console.log(`[AudioQueue] Adding chunk #${chunkIndex}, nextToPlay: #${this.nextChunkToPlay}, isPlaying: ${this.isPlaying}`);

    // Store chunk by index
    this.chunkBuffer[chunkIndex] = audioBase64;

    // Try to play if:
    // 1. We're not currently playing anything, OR
    // 2. We were waiting for this specific chunk (it's the next one to play)
    if (!this.isPlaying) {
      console.log(`[AudioQueue] Not playing, starting playback`);
      await this.playNext();
    } else if (chunkIndex === this.nextChunkToPlay) {
      console.log(`[AudioQueue] Received the chunk we were waiting for (#${chunkIndex}), will play after current finishes`);
      // Don't call playNext here - let the onended handler do it
    } else {
      console.log(`[AudioQueue] Buffered chunk #${chunkIndex} for later`);
    }
  }

  private async playNext() {
    // Check if the next sequential chunk is available
    if (!this.chunkBuffer.hasOwnProperty(this.nextChunkToPlay)) {
      this.isPlaying = false;
      console.log(`[AudioQueue] ⏸️ Waiting for chunk #${this.nextChunkToPlay}. Buffer:`, Object.keys(this.chunkBuffer));
      return;
    }

    this.isPlaying = true;
    const audioBase64 = this.chunkBuffer[this.nextChunkToPlay];
    const currentChunk = this.nextChunkToPlay;

    // Remove from buffer and increment
    delete this.chunkBuffer[currentChunk];
    this.nextChunkToPlay++;

    console.log(`[AudioQueue] ▶️ Playing chunk #${currentChunk}, next will be #${this.nextChunkToPlay}`);

    try {
      const audioBlob = new Blob(
        [Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0))],
        { type: 'audio/mpeg' }
      );
      const audioUrl = URL.createObjectURL(audioBlob);

      this.currentAudio = new Audio(audioUrl);

      await this.currentAudio.play();

      this.currentAudio.onended = () => {
        console.log(`[AudioQueue] ✅ Chunk #${currentChunk} finished playing`);
        URL.revokeObjectURL(audioUrl);
        // Small delay to ensure any pending chunks have arrived
        setTimeout(() => this.playNext(), 50);
      };

      this.currentAudio.onerror = (error) => {
        console.error('[AudioQueue] ❌ Audio playback error:', error);
        URL.revokeObjectURL(audioUrl);
        this.playNext();
      };
    } catch (error) {
      console.error('[AudioQueue] ❌ Error playing audio chunk:', error);
      this.playNext();
    }
  }

  stop() {
    this.currentAudio?.pause();
    this.currentAudio = null;
    this.chunkBuffer = {};
    this.nextChunkToPlay = 0;
    this.isPlaying = false;
  }

  clear() {
    this.stop();
  }

  reset() {
    // Reset for new conversation
    this.chunkBuffer = {};
    this.nextChunkToPlay = 0;
    this.isPlaying = false;
    console.log('[AudioQueue] Reset for new conversation');
  }

  finalize(totalChunks: number) {
    // Called when server confirms all chunks have been sent
    console.log(`[AudioQueue] 🏁 Finalize called. Total chunks: ${totalChunks}, nextToPlay: ${this.nextChunkToPlay}`);

    // Check if we're waiting for a chunk that will never arrive
    if (!this.isPlaying && this.nextChunkToPlay < totalChunks) {
      console.log(`[AudioQueue] ⚠️ Missing chunks detected! Expected ${totalChunks}, only have up to ${this.nextChunkToPlay - 1}`);
      console.log(`[AudioQueue] Buffered chunks:`, Object.keys(this.chunkBuffer));
    }

    // If we've finished playing all chunks, call completion
    if (this.nextChunkToPlay >= totalChunks && !this.isPlaying) {
      console.log('[AudioQueue] ✅ All chunks played successfully');
      this.onPlaybackComplete?.();
    }
  }
}
