import mysql from 'mysql2/promise';
export const pool = mysql.createPool(
  process.env.DATABASE_URL
    ? {
        ...Object.fromEntries(
          (() => {
            const u = new URL(process.env.DATABASE_URL);
            return [
              ['host', u.hostname],
              ['port', Number(u.port || 3306)],
              ['user', decodeURIComponent(u.username)],
              ['password', decodeURIComponent(u.password)],
              ['database', u.pathname.slice(1)],
            ];
          })(),
        ),
        socketPath: process.env.MYSQL_SOCKET || undefined,
        connectionLimit: 5,
        timezone: 'Z',
        supportBigNumbers: true,
      }
    : {
        host: '127.0.0.1',
        user: 'climbpass',
        database: 'climbpass',
        connectionLimit: 5,
        timezone: 'Z',
      },
);
export const json = (value) => (typeof value === 'string' ? JSON.parse(value) : value);
export async function transaction(fn) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}
