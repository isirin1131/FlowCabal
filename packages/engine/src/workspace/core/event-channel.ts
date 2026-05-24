// mpsc-like async channel：多生产者 push，单消费者 await next()
export class EventChannel<T> {
  private buffer: T[] = [];
  private resolvers: ((value: T | null) => void)[] = [];
  private closed = false;

  push(value: T): void {
    if (this.closed) return;
    if (this.resolvers.length > 0) {
      this.resolvers.shift()!(value);
    } else {
      this.buffer.push(value);
    }
  }

  async next(): Promise<T | null> {
    if (this.buffer.length > 0) return this.buffer.shift()!;
    if (this.closed) return null;
    return new Promise<T | null>((resolve) => this.resolvers.push(resolve));
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const r of this.resolvers) r(null);
    this.resolvers = [];
  }
}
