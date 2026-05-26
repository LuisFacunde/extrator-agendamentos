import oracledb from "oracledb";
import { getConnection } from './config/database';

async function main() {
    try {
        const connection: oracledb.Connection = await getConnection();
        console.log('✅ Conexão com Oracle estabelecida!');
        await connection.close();
    } catch (err) {
        console.error('❌ Erro ao conectar:', err);
    }
}

main();