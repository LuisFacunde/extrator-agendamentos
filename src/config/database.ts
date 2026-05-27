import oracledb from "oracledb";
import dotenv from "dotenv";

dotenv.config();

function validateEnv(): void {
    const required = ['DB_USER', 'DB_PASSWORD', 'DB_HOST', 'DB_PORT', 'DB_SERVICE'];
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`Variáveis de ambiente ausentes: ${missing.join(', ')}`);
    }
}

function initOracleClient(): void {
    if (process.env.ORACLE_CLIENT_PATH) {
        try {
            oracledb.initOracleClient({ libDir: process.env.ORACLE_CLIENT_PATH });
            console.log("Oracle Client (Thick Mode) inicializado.");
        } catch (err: any) {
            if (err.code !== 'NJS-083') {
                throw new Error(`Erro ao inicializar Oracle Client: ${err.message}`);
            }
        }
    } else {
        console.warn("ORACLE_CLIENT_PATH não definido. Usando Thin Mode...");
    }
}

let pool: oracledb.Pool;

export async function initPool(): Promise<void> {
    validateEnv();
    initOracleClient();

    pool = await oracledb.createPool({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectString: `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_SERVICE}`,
        poolMin: 2,
        poolMax: 10,
        poolIncrement: 1,
    });
    console.log("Connection pool criado com sucesso.");
}

export async function withConnection<T>(
    fn: (connection: oracledb.Connection) => Promise<T>
): Promise<T> {
    const connection = await pool.getConnection();
    try {
        return await fn(connection);
    } finally {
        await connection.close();
    }
}