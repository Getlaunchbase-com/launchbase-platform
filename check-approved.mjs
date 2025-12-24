import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const [result] = await connection.query('SELECT id, businessName, status, paidAt, previewToken FROM intakes WHERE status = "approved" LIMIT 1');
console.log(JSON.stringify(result, null, 2));
await connection.end();
