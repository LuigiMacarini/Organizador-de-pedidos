import "dotenv/config";
import cors from "@fastify/cors";
import Fastify from "fastify";
import authGuard from "./interface/http/plugins/authGuard.js";
import { registerErrorHandler } from "./interface/http/plugins/errorHandler.js";
import authRoutes from "./interface/http/routes/auth.js";
import customerRoutes from "./interface/http/routes/customers.js";
import productRoutes from "./interface/http/routes/products.js";
import orderRoutes from "./interface/http/routes/orders.js";
import routeRoutes from "./interface/http/routes/routes.js";
import deliveryRoutes from "./interface/http/routes/deliveries.js";
import placeRoutes from "./interface/http/routes/places.js";

const PORT = Number(process.env.PORT) || 3333;

async function buildServer() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  });

  registerErrorHandler(app);
  await app.register(authGuard);

  app.get("/health", async () => ({ ok: true }));

  await app.register(authRoutes);
  await app.register(customerRoutes);
  await app.register(productRoutes);
  await app.register(orderRoutes);
  await app.register(routeRoutes);
  await app.register(deliveryRoutes);
  await app.register(placeRoutes);

  return app;
}

async function main() {
  const app = await buildServer();
  try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main();
