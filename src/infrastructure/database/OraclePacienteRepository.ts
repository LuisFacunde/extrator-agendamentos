import oracledb from "oracledb";
import { withConnection } from "../../config/database";
import type { IPacienteRepository } from "../../domain/repositories/IPacienteRepository";
import type { PacienteComRetornos } from "../../domain/entities/Paciente";

export class OraclePacienteRepository implements IPacienteRepository {

    private cleanValue(val: string | null | undefined): string | null {
        if (!val) return null;
        const parts = val.split("||");
        const second = parts[1];
        return second ? second.trim() : val.trim();
    }

    async fetchComRetornos(limit: number): Promise<PacienteComRetornos[]> {
        return withConnection(async (connection) => {
            const result = await connection.execute<any>(
                `SELECT * FROM (
                    SELECT 
                        pdc.cd_atendimento AS cd_atendimento,
                        p.cd_paciente AS prontuario,
                        p.nm_paciente AS paciente,
                        TRUNC(pdc.dh_criacao) AS data_criacao,
                        le.dt_retorno_calc AS dt_retorno_calc,
                        MAX(CASE WHEN ec.ds_identificador = 'obs_2229_1'
                            THEN DBMS_LOB.SUBSTR(erc.lo_valor, 4000, 1) END) AS observacao,
                        MAX(CASE WHEN ec.ds_identificador = 'amb_especializado_2229_2_1'
                            THEN DBMS_LOB.SUBSTR(erc.lo_valor, 4000, 1) END) AS amb_especializado_1,
                        MAX(CASE WHEN ec.ds_identificador = 'amb_dt_retorno_1'
                            THEN DBMS_LOB.SUBSTR(erc.lo_valor, 4000, 1) END) AS amb_dt_retorno_1,
                        MAX(CASE WHEN ec.ds_identificador = 'amb_especializado_2229_3_1'
                            THEN DBMS_LOB.SUBSTR(erc.lo_valor, 4000, 1) END) AS amb_especializado_2,
                        MAX(CASE WHEN ec.ds_identificador = 'amb_dt_retorno_2_1'
                            THEN DBMS_LOB.SUBSTR(erc.lo_valor, 4000, 1) END) AS amb_dt_retorno_2,
                        MAX(CASE WHEN ec.ds_identificador = 'amb_especializado_2229_4_1'
                            THEN DBMS_LOB.SUBSTR(erc.lo_valor, 4000, 1) END) AS amb_especializado_3,
                        MAX(CASE WHEN ec.ds_identificador = 'amb_dt_retorno_3_1'
                            THEN DBMS_LOB.SUBSTR(erc.lo_valor, 4000, 1) END) AS amb_dt_retorno_3,
                        MAX(CASE WHEN ec.ds_identificador = 'mc_data_2229_1'
                            THEN DBMS_LOB.SUBSTR(erc.lo_valor, 4000, 1) END) AS mc_data,
                        MAX(CASE WHEN ec.ds_identificador = 'mc_setor_2229_1'
                            THEN DBMS_LOB.SUBSTR(erc.lo_valor, 4000, 1) END) AS mc_setor
                    FROM pw_documento_clinico pdc
                        JOIN pw_editor_clinico pec
                            ON pdc.cd_documento_clinico = pec.cd_documento_clinico
                        JOIN editor_registro_campo erc
                            ON pec.cd_editor_registro = erc.cd_registro
                        JOIN editor_campo ec
                            ON erc.cd_campo = ec.cd_campo
                        JOIN atendime a
                            ON pdc.cd_atendimento = a.cd_atendimento
                        JOIN paciente p
                            ON a.cd_paciente = p.cd_paciente
                        LEFT JOIN fav_lista_espera le
                            ON pdc.cd_atendimento = le.cd_atendimento
                    WHERE pdc.tp_status = 'FECHADO'
                        AND pec.cd_documento IN (583, 603, 604, 605, 606)
                        AND ec.ds_identificador IN (
                            'obs_2229_1',
                            'amb_especializado_2229_2_1', 'amb_dt_retorno_1',
                            'amb_especializado_2229_3_1', 'amb_dt_retorno_2_1',
                            'amb_especializado_2229_4_1', 'amb_dt_retorno_3_1',
                            'mc_data_2229_1', 'mc_setor_2229_1'
                        )
                        AND pdc.dh_criacao >= ADD_MONTHS(SYSDATE, -12)
                        AND le.tp_situacao = 'S'
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
            return rows.map((row: any): PacienteComRetornos => ({
                cdAtendimento: row.CD_ATENDIMENTO,
                prontuario: row.PRONTUARIO,
                paciente: row.PACIENTE,
                dataCriacao: new Date(row.DATA_CRIACAO),
                dtRetornoCalc: row.DT_RETORNO_CALC ? new Date(row.DT_RETORNO_CALC) : null,
                observacao: row.OBSERVACAO ?? null,
                ambEspecializado1: this.cleanValue(row.AMB_ESPECIALIZADO_1),
                ambDtRetorno1: this.cleanValue(row.AMB_DT_RETORNO_1),
                ambEspecializado2: this.cleanValue(row.AMB_ESPECIALIZADO_2),
                ambDtRetorno2: this.cleanValue(row.AMB_DT_RETORNO_2),
                ambEspecializado3: this.cleanValue(row.AMB_ESPECIALIZADO_3),
                ambDtRetorno3: this.cleanValue(row.AMB_DT_RETORNO_3),
                mcData: this.cleanValue(row.MC_DATA),
                mcSetor: this.cleanValue(row.MC_SETOR),
            }));
        });
    }

    async updateDtRetornoCalc(prontuario: number, dtRetorno: Date | null): Promise<void> {
        return withConnection(async (connection) => {
            if (!dtRetorno) {
                console.log(`[Oracle] Paciente ${prontuario}: data nula — nenhuma atualização realizada.`);
                return;
            }

            const result = await connection.execute(
                `UPDATE fav_lista_espera le
                 SET le.dt_retorno_calc = :dtRetorno
                 WHERE le.cd_atendimento = (
                    SELECT a.cd_atendimento
                    FROM atendime a
                    WHERE a.cd_paciente = :prontuario
                    AND   a.tp_atendimento = 'A'
                    AND   a.dt_atendimento = (
                        SELECT MAX(a2.dt_atendimento)
                        FROM atendime a2
                        WHERE a2.cd_paciente = :prontuario
                        AND   a2.tp_atendimento = 'A'
                    )
                    AND ROWNUM = 1
                )
                AND :dtRetorno > SYSDATE
                AND le.tp_situacao = 'S'`,
                { dtRetorno, prontuario },
                { autoCommit: true }
            );

            if (result.rowsAffected && result.rowsAffected > 0) {
                console.log(
                    `[Oracle] Paciente ${prontuario}: dt_retorno_calc → ${dtRetorno.toLocaleDateString("pt-BR")}.`
                );
            } else {
                console.log(
                    `[Oracle] Paciente ${prontuario}: nenhuma linha atualizada ` +
                    `(não encontrado, data passada ou situação inativa).`
                );
            }
        });
    }
}
