<?php

$conn = new mysqli("localhost","root","","college");

$order = isset($_GET['sort']) ? $_GET['sort'] : "name";

$sql="SELECT * FROM students ORDER BY $order";

$result=$conn->query($sql);

?>

<html>
<body style="font-family:Arial">

<h2>Student Dashboard</h2>

<a href="?sort=name">Sort by Name</a>
<a href="?sort=dob">Sort by DOB</a>

<table border="1" cellpadding="10">
<tr>
<th>Name</th>
<th>Department</th>
<th>DOB</th>
</tr>

<?php
while($row=$result->fetch_assoc()){
echo "<tr>
<td>".$row['name']."</td>
<td>".$row['department']."</td>
<td>".$row['dob']."</td>
</tr>";
}
?>

</table>

</body>
</html>