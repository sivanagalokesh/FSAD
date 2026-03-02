<?php

$conn = new mysqli("localhost","root","","shop");

$sql="SELECT customers.name,products.product_name,orders.amount
FROM orders
JOIN customers ON orders.customer_id=customers.id
JOIN products ON orders.product_id=products.id";

$result=$conn->query($sql);

echo "<h2>Order History</h2>";

while($row=$result->fetch_assoc()){
echo $row['name']." bought ".$row['product_name']." - ₹".$row['amount']."<br>";
}

?>