import { Component, OnDestroy, OnInit } from '@angular/core';
import type { ProbeRequest, ProducerWorkerResponse } from '../producer-worker-protocol';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
  producerStatus = 'Initializing the WebAssembly producer...';
  private worker?: Worker;

  ngOnInit(): void {
    try {
      this.worker = new Worker(new URL('../producer.worker', import.meta.url), {
        type: 'module'
      });
      this.worker.onmessage = ({ data }: MessageEvent<ProducerWorkerResponse>) => {
        this.producerStatus = data.type === 'error'
          ? `Initialization failed: ${data.message}`
          : `Ready (Wasm ABI v${data.abiVersion})`;
      };
      this.worker.onerror = (event) => {
        this.producerStatus = `Worker failed to initialize: ${event.message}`;
      };
      const request: ProbeRequest = {
        type: 'probe',
        requestId: 1,
        input: 1,
        wasmUrl: new URL('market-producer.wasm', document.baseURI).href
      };
      this.worker.postMessage(request);
    } catch (error) {
      this.producerStatus = `Worker failed to initialize: ${
        error instanceof Error ? error.message : 'Unknown error.'
      }`;
    }
  }

  ngOnDestroy(): void {
    this.worker?.terminate();
  }
}
