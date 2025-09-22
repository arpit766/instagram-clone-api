const mysql=require('mysql2/promise');

const pool=mysql.createPool({
    host:"localhost",
    user:"root",   
    password:"Ram@1234",
    database:"instagram_clone",
});


module.exports=pool;