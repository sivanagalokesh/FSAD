<?php

$conn = new mysqli("localhost","root","","bank");

$conn->begin_transaction();

try{

$conn->query("UPDATE accounts SET balance=balance-500 WHERE id=1");

$conn->query("UPDATE accounts SET balance=balance+500 WHERE id=2");

$conn->commit();

echo "Payment Successful";

}

catch(Exception $e){

$conn->rollback();

echo "Transaction Failed";

}

?>