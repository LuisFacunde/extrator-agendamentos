import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { initPool, closePool } from "../../config/database";

/**
 * CAMADA: API — Plugin Fastify (Oracle)
 *
 * Plugin responsável pelo ciclo de vida do pool de conexões Oracle dentro do servidor.
 *
 * POR QUE UM PLUGIN?
 * O Fastify tem um sistema de encapsulamento (scoping) baseado em plugins.
 * Usar `fastify-plugin` com `fp()` remove o escopo, tornando o efeito deste
 * plugin (inicialização do pool) visível para todos os outros plugins e rotas.
 *
 * CICLO DE VIDA:
 * - STARTUP: `initPool()` é chamado antes do servidor começar a escutar requisições.
 *   Se o pool falhar, o servidor não inicia.
 * - SHUTDOWN: O hook `onClose` garante que o pool seja fechado graciosamente
 *   quando o servidor receber sinal de encerramento (SIGTERM, Ctrl+C, etc.),
 *   aguardando conexões ativas por até 10 segundos.
 */
const oraclePlugin: FastifyPluginAsync = async (fastify) => {

    fastify.log.info("[Oracle Plugin] Inicializando pool de conexões...");

    // initPool() valida env vars, inicializa o Oracle Client e cria o pool.
    // Qualquer erro aqui derruba o startup do servidor de forma controlada.
    await initPool();

    fastify.log.info("[Oracle Plugin] Pool Oracle inicializado com sucesso.");

    // Hook de shutdown: fecha o pool graciosamente antes do servidor encerrar.
    // O parâmetro `done` (callback) é necessário para Fastify 4+.
    fastify.addHook("onClose", async () => {
        fastify.log.info("[Oracle Plugin] Fechando pool de conexões Oracle...");
        try {
            await closePool(10); // Aguarda até 10s pelas conexões ativas
            fastify.log.info("[Oracle Plugin] Pool Oracle fechado com sucesso.");
        } catch (err) {
            fastify.log.error({ err }, "[Oracle Plugin] Erro ao fechar pool Oracle.");
        }
    });
};

// `fp()` remove o encapsulamento do Fastify, tornando os efeitos do plugin
// (e qualquer decoração que ele fizer) visíveis globalmente no servidor.
export default fp(oraclePlugin, {
    name: "oracle-plugin",
    fastify: "5.x"
});
