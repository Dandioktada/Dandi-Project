<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<title>Latihan Struktur Kendali</title>
	<style>
		.warna-baris{
			background-color: silver;
		}

	</style>
</head>
<body>

 <table border="1" cellpadding="10" cellspacing="0">
	<?php 
		for ($i=1; $i <=3 ; $i++) { 
			echo "<tr>";
			for ($j=1; $j <=5 ; $j++) { 
				echo "<td>$i,$j</td>";
			}
			echo "</tr>";
		}
	 ?>
</table>
<hr>
<table border="1" cellpadding="10" cellspacing="0">
	<?php for ($i=1; $i <=5 ; $i++) : ?>
		<?php if ($i %2) : ?>
			<tr class="warna-baris">
		<?php else: ?>
			<tr>
		<?php endif; ?>
			<?php for ($j=1; $j <=5 ; $j++) : ?>
				<td><?php echo "$i,$j"; ?></td>
			<?php endfor; ?>
		</tr>
	<?php endfor; ?>
</table>


</body>
</html>