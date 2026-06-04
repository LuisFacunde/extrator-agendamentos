import oracledb from "oracledb";
import { withConnection } from "../config/database";

export interface Paciente {
    [key: string]: any;
}

export async function fetchPacientes(limit: number): Promise<Paciente[]> {
    return withConnection(async (connection) => {
        const result = await connection.execute<Paciente>(
            `SELECT * FROM (
                SELECT pdc.cd_atendimento AS Atendimento,
                        p.cd_paciente AS prontuario,
                        p.nm_paciente AS paciente,
                        TRUNC(pdc.dh_criacao) AS data_criacao,
                        erc.lo_valor AS observacao
                FROM pw_documento_clinico pdc
                    JOIN pw_editor_clinico pec ON pdc.cd_documento_clinico = pec.cd_documento_clinico
                    JOIN editor_registro_campo erc ON pec.cd_editor_registro = erc.cd_registro
                    JOIN editor_campo ec ON erc.cd_campo = ec.cd_campo
                    JOIN atendime a ON pdc.cd_atendimento = a.cd_atendimento
                    JOIN paciente p ON a.cd_paciente = p.cd_paciente
                WHERE pdc.tp_status = 'FECHADO'
                    AND pec.cd_documento IN (583, 603, 604, 605, 606)
                    AND ec.ds_identificador IN ('obs_2229_1')
                    AND erc.lo_valor IS NOT NULL
                    AND pdc.dh_criacao >= ADD_MONTHS(SYSDATE, -12)
                ORDER BY pdc.dh_criacao DESC
            ) WHERE ROWNUM <= :limit`,
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

export async function updateDtRetornoCalc(cdPaciente: number, dtRetorno: Date | null): Promise<void> {
    return withConnection(async (connection) => {

        if (!dtRetorno) {
            console.log(`Paciente ${cdPaciente}: a data é nula. Nenhuma atualização realizada.`);
            return;
        }

        const result = await connection.execute(
            `UPDATE fav_lista_espera le
             SET le.dt_retorno_calc = :dtRetorno
             WHERE le.cd_atendimento = (
                SELECT a.cd_atendimento
                FROM atendime a
                WHERE a.cd_paciente    = :cdPaciente
                AND   a.tp_atendimento = 'A'
                AND   a.dt_atendimento = (
                    SELECT MAX(a2.dt_atendimento)
                    FROM atendime a2
                    WHERE a2.cd_paciente    = :cdPaciente
                    AND   a2.tp_atendimento = 'A'
                )
            AND ROWNUM = 1
            )
            AND :dtRetorno > SYSDATE`,
            {
                dtRetorno: dtRetorno,
                cdPaciente: cdPaciente
            },
            { autoCommit: true }
        );
        if (result.rowsAffected && result.rowsAffected > 0) {
            console.log(`[Oracle] Paciente ${cdPaciente}: dt_retorno_calc atualizado para ${dtRetorno.toLocaleDateString('pt-BR')}.`);
        } else {
            console.log(`[Oracle] Paciente ${cdPaciente}: Nenhuma linha atualizada (paciente não encontrado na tabela fav_lista_espera).`);
        }
    });
}
