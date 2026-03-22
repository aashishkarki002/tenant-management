// thread-example.js
import { Worker, isMainThread, parentPort } from "worker_threads";

if (isMainThread) {
  console.log("Main thread: Starting worker...");
  const worker = new Worker(); // runs the same file as a worker
  worker.on("message", (msg) => {
    console.log(`Main thread received: ${msg}`);
  });
  worker.on("exit", () => {
    console.log("Worker thread exited.");
  });
} else {
  console.log("Worker thread: Doing some heavy computation...");
  let sum = 0;
  for (let i = 0; i < 1000000000; i++) {
    sum += i;
  }
  parentPort.postMessage(`Worker thread: Sum is ${sum}`);
}
