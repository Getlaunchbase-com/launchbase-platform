import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const [result] = await connection.query('SELECT * FROM email_logs ORDER BY sentAt DESC LIMIT 10');
console.log(JSON.stringify(result, null, 2));
await connection.end();
