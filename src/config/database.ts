import oracledb from "oracledb";
import dotenv from "dotenv";

dotenv.config();

// Inicializa o Thick Mode se o caminho do Instant Client for fornecido no .env
if (process.env.ORACLE_CLIENT_PATH) {
    try {
        oracledb.initOracleClient({ libDir: process.env.ORACLE_CLIENT_PATH });
        console.log("✅ Oracle Client (Thick Mode) inicializado com sucesso.");
    } catch (err: any) {
        // NJS-083 ocorre se o cliente já tiver sido inicializado
        if (err.code !== 'NJS-083') {
            console.error("Erro ao inicializar Oracle Client:", err);
        }
    }
} else {
    console.warn("⚠️ ORACLE_CLIENT_PATH não definido no .env. Tentando conectar em Thin Mode...");
}

export async function getConnection(): Promise<oracledb.Connection> {
    try {
        const connection = await oracledb.getConnection({
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            connectString: `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_SERVICE}`,
        });
        console.log("Conexão com o Oracle estabelecida com sucesso");
        return connection;
    } catch (error) {
        console.error("Erro ao conectar ao Oracle:", error);
        throw error;
    }
}