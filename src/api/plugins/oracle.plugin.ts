import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { initPool, closePool } from "../../config/database";

const oraclePlugin: FastifyPluginAsync = async (fastify) => {

    fastify.log.info("[Oracle Plugin] Inicializando pool de conexões...");

    await initPool();

    fastify.log.info("[Oracle Plugin] Pool Oracle inicializado com sucesso.");

    fastify.addHook("onClose", async () => {
        fastify.log.info("[Oracle Plugin] Fechando pool de conexões Oracle...");
        try {
            await closePool(10);
            fastify.log.info("[Oracle Plugin] Pool Oracle fechado com sucesso.");
        } catch (err) {
            fastify.log.error({ err }, "[Oracle Plugin] Erro ao fechar pool Oracle.");
        }
    });
};

export default fp(oraclePlugin, {
    name: "oracle-plugin",
    fastify: "5.x"
});
