#!/bin/bash

mkdir -p Source
mkdir -p Trimmed
mkdir -p Fast
mkdir -p Finished

echo "Generating source counts..."

voice=Zarvox

say -v $voice -o Source/1.aiff 1
say -v $voice -o Source/2.aiff 2
say -v $voice -o Source/3.aiff 3
say -v $voice -o Source/4.aiff 4
say -v $voice -o Source/5.aiff 5
say -v $voice -o Source/6.aiff 6
say -v $voice -o Source/7.aiff 7
say -v $voice -o Source/8.aiff 8
say -v $voice -o Source/9.aiff 9
say -v $voice -o Source/10.aiff 10
say -v $voice -o Source/rea-.aiff reh
say -v $voice -o Source/-dy.aiff dee
say -v $voice -o Source/go.aiff go

echo "Trimming silence from beginning and end..."

for filename in Source/*.aiff; do
    sox "$filename" "Trimmed/$(basename "$filename")" silence 1 0.01 1% 1 0.1 1%
done

echo "Speeding up..."

for filename in Trimmed/*.aiff; do
    sox "$filename" "Fast/$(basename "$filename")" tempo 1.6
done

echo "Encoding as MP3s..."

for filename in Fast/*.aiff; do
    lame "$filename" "Finished/$(basename "$filename" .aiff).mp3"
done

echo "Finished!"