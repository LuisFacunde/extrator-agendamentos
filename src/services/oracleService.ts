import oracledb from "oracledb";
import { withConnection } from "../config/database";

export interface Paciente {
    [key: string]: any;
}

export async function fetchPacientes(limit: number): Promise<Paciente[]> {
    return withConnection(async (connection) => {
        const result = await connection.execute<Paciente>(
            `SELECT cd_paciente AS prontuario, nm_paciente AS nome, to_date(dt_nascimento) AS data_nascimento FROM paciente WHERE ROWNUM <= :limit`,
            { limit },
            {
                outFormat: oracledb.OUT_FORMAT_OBJECT,
                fetchTypeHandler: (metaData) => {
                    if (metaData.dbType === oracledb.DB_TYPE_CLOB) {
                        return { type: oracledb.STRING };
                    }
                },
            }
        );

        return result.rows ?? [];
    });
}