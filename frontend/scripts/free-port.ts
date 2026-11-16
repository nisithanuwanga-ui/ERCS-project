import { createServer } from "node:net";
export async function freePort() {
  return new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string")
        return reject(new Error("No test port available."));
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}
