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

export interface PacienteComRetornos {
    cdAtendimento: number;
    prontuario: number;
    paciente: string;
    dataCriacao: Date;
    dtRetornoCalc: Date | null;
    observacao: string | null;
    ambEspecializado1: string | null;
    ambDtRetorno1: string | null;
    ambEspecializado2: string | null;
    ambDtRetorno2: string | null;
    ambEspecializado3: string | null;
    ambDtRetorno3: string | null;
}

function cleanValue(val: string | null): string | null {
    if (!val) return null;
    const parts = val.split("||");
    const second = parts[1];
    return second ? second.trim() : val.trim();
}

export async function fetchPacientesComRetornos(limit: number): Promise<PacienteComRetornos[]> {
    return withConnection(async (connection) => {
        const result = await connection.execute<any>(
            `SELECT * FROM (
                SELECT 
                    pdc.cd_atendimento AS cd_atendimento,
                    p.cd_paciente AS prontuario,
                    p.nm_paciente AS paciente,
                    TRUNC(pdc.dh_criacao) AS data_criacao,
                    le.dt_retorno_calc AS dt_retorno_calc,
                    MAX(CASE WHEN ec.ds_identificador = 'obs_2229_1' THEN DBMS_LOB.SUBSTR(erc.lo_valor, 4000, 1) END) AS observacao,
                    MAX(CASE WHEN ec.ds_identificador = 'amb_especializado_2229_2_1' THEN DBMS_LOB.SUBSTR(erc.lo_valor, 4000, 1) END) AS amb_especializado_1,
                    MAX(CASE WHEN ec.ds_identificador = 'amb_dt_retorno_1' THEN DBMS_LOB.SUBSTR(erc.lo_valor, 4000, 1) END) AS amb_dt_retorno_1,
                    MAX(CASE WHEN ec.ds_identificador = 'amb_especializado_2229_3_1' THEN DBMS_LOB.SUBSTR(erc.lo_valor, 4000, 1) END) AS amb_especializado_2,
                    MAX(CASE WHEN ec.ds_identificador = 'amb_dt_retorno_2_1' THEN DBMS_LOB.SUBSTR(erc.lo_valor, 4000, 1) END) AS amb_dt_retorno_2,
                    MAX(CASE WHEN ec.ds_identificador = 'amb_especializado_2229_4_1' THEN DBMS_LOB.SUBSTR(erc.lo_valor, 4000, 1) END) AS amb_especializado_3,
                    MAX(CASE WHEN ec.ds_identificador = 'amb_dt_retorno_3_1' THEN DBMS_LOB.SUBSTR(erc.lo_valor, 4000, 1) END) AS amb_dt_retorno_3
                FROM pw_documento_clinico pdc
                    JOIN pw_editor_clinico pec ON pdc.cd_documento_clinico = pec.cd_documento_clinico
                    JOIN editor_registro_campo erc ON pec.cd_editor_registro = erc.cd_registro
                    JOIN editor_campo ec ON erc.cd_campo = ec.cd_campo
                    JOIN atendime a ON pdc.cd_atendimento = a.cd_atendimento
                    JOIN paciente p ON a.cd_paciente = p.cd_paciente
                    LEFT JOIN fav_lista_espera le ON pdc.cd_atendimento = le.cd_atendimento
                WHERE pdc.tp_status = 'FECHADO'
                    AND pec.cd_documento IN (583, 603, 604, 605, 606)
                    AND ec.ds_identificador IN (
                        'obs_2229_1',
                        'amb_especializado_2229_2_1', 'amb_dt_retorno_1',
                        'amb_especializado_2229_3_1', 'amb_dt_retorno_2_1',
                        'amb_especializado_2229_4_1', 'amb_dt_retorno_3_1'
                    )
                    AND pdc.dh_criacao >= ADD_MONTHS(SYSDATE, -12)
                GROUP BY 
                    pdc.cd_atendimento,
                    p.cd_paciente,
                    p.nm_paciente,
                    TRUNC(pdc.dh_criacao),
                    le.dt_retorno_calc
                ORDER BY TRUNC(pdc.dh_criacao) DESC
            ) WHERE ROWNUM <= :limit`,
            { limit },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        const rows = result.rows ?? [];
        return rows.map((row: any) => ({
            cdAtendimento: row.CD_ATENDIMENTO,
            prontuario: row.PRONTUARIO,
            paciente: row.PACIENTE,
            dataCriacao: new Date(row.DATA_CRIACAO),
            dtRetornoCalc: row.DT_RETORNO_CALC ? new Date(row.DT_RETORNO_CALC) : null,
            observacao: row.OBSERVACAO,
            ambEspecializado1: cleanValue(row.AMB_ESPECIALIZADO_1),
            ambDtRetorno1: cleanValue(row.AMB_DT_RETORNO_1),
            ambEspecializado2: cleanValue(row.AMB_ESPECIALIZADO_2),
            ambDtRetorno2: cleanValue(row.AMB_DT_RETORNO_2),
            ambEspecializado3: cleanValue(row.AMB_ESPECIALIZADO_3),
            ambDtRetorno3: cleanValue(row.AMB_DT_RETORNO_3),
        }));
    });
}
