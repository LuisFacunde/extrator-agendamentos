import "dotenv/config";
import Fastify, { type FastifyError } from "fastify";
import sensible from "@fastify/sensible";
import oraclePlugin from "./plugins/oracle.plugin";
import retornosRoutes from "./routes/retornos.routes";

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const HOST = process.env.HOST ?? "0.0.0.0";

export async function buildServer() {
    const fastify = Fastify({
        logger: process.env.NODE_ENV !== "production"
            ? {
                level: "info",
                transport: {
                    target: "pino-pretty",
                    options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" }
                }
            }
            : { level: "info" }
    });

    await fastify.register(sensible);

    await fastify.register(oraclePlugin);

    await fastify.register(retornosRoutes, { prefix: "/api" });

    fastify.setErrorHandler((error: FastifyError, request, reply) => {
        fastify.log.error(
            { err: error, method: request.method, url: request.url },
            "Erro não tratado capturado pelo error handler global"
        );
        reply.status(error.statusCode ?? 500).send({
            success: false,
            error: error.message ?? "Erro interno do servidor",
            ...(process.env.NODE_ENV !== "production" && { stack: error.stack })
        });
    });

    fastify.get("/health", async () => ({
        status: "ok",
        version: process.env.npm_package_version ?? "1.0.0",
        time: new Date().toISOString()
    }));

    return fastify;
}

async function main(): Promise<void> {
    const fastify = await buildServer();

    try {
        await fastify.listen({ port: PORT, host: HOST });
        fastify.log.info(`Servidor iniciado em http://${HOST}:${PORT}`);
    } catch (err) {
        fastify.log.error(err, "Falha ao iniciar o servidor");
        process.exit(1);
    }
}

main();
