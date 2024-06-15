#!/bin/bash

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null
then
    echo "ImageMagick could not be found. Please install it and try again."
    exit 1
fi

# Create output subfolder if it doesn't exist
output_folder="output"
mkdir -p "$output_folder"

# Loop through the images and add text
for i in {0..7}; do
    input_file="floor$i.png"
    output_file="${output_folder}/floor${i}_text.png"
    text="floor $i"
    
    if [ -f "$input_file" ]; then
        convert "$input_file" -gravity northeast -pointsize 72 -fill black -annotate +10+10 "$text" "$output_file"
        echo "Added text to $input_file, saved as $output_file"
    else
        echo "File $input_file does not exist."
    fi
done

echo "Processing completed."
