<?php 
// Pertemuan 2 - PHP Dasar
// Sintaks PHP

// Standar Output
//echo, print
// print_r
// var_dump

echo "Sheris Dandi";
print("<br>Sheris Dandi");
print_r("<br>Sheris Dandi<br>");
var_dump("Sheris Dandi");

// Belajar sintak PHP
// 1. PHP di dalam HTML
// 2. HTML di dalam PHP

// Variabel dan Tipe Data
// tidak boleh diawali dengan angka, tidak boleh mengandung angka
$nama = "Sheris Dandi";
echo "<br>Halo, nama saya $nama";
echo '<br>Halo, nama saya $nama';

// Operator
// Aritmatika
// + - * / %
$x = 10;
$y = 10;
echo "<br>" . "$x x $y = " . $x * $y;

// penghubung string / concatenation / concat
// .
$nama_depan = "Sheris";
$nama_belakang = "Dandi";
echo "<br>" . $nama_depan . " " . $nama_belakang;

//Assigment
// =, +=, -=, /=, %=, .=
$a = 2;
$a +=5;
echo "<br>" . $a;

$name = "Sheris";
$name .= " ";
$name .= "Dandi";
echo "<br>" . $name . "<br>";

// Perbandingan
// <, >, <=, >=, ==, !=
var_dump (1 < 5);
var_dump (1 == 1);
var_dump (1 == "1");

// Logika
// &&, ||, !
$c = 10;
var_dump($c > 20 && $c % 2 == 0);
var_dump($c > 20 || $c % 2 == 0);






?>
