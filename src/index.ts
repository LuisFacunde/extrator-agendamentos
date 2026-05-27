import { initPool } from "./config/database";
import { fetchPacientes } from "./services/oracleService";

async function main() {
    await initPool();

    const pacientes = await fetchPacientes(10);
    console.log(`${pacientes.length} pacientes retornados:`);
    console.log(JSON.stringify(pacientes, null, 2));
}

main().catch(console.error);