import oracledb from "oracledb";
import dotenv from "dotenv";

dotenv.config();

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