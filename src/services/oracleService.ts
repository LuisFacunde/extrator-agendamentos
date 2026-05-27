import { withConnection } from "../config/database";

const resultado = await withConnection(async (connect) => {
    return await connect.execute('SELECT * FROM pacientes LIMIT 50');
});