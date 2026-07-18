import os
import sys
from PIL import Image

def main():
    target_dir = r"c:\Users\User\OneDrive\程式設計\galgame-engine\public\stories\hong_men_yan\images\bg"
    for filename in os.listdir(target_dir):
        if not filename.lower().endswith(".png"):
            continue
        filepath = os.path.join(target_dir, filename)
        try:
            with Image.open(filepath) as img:
                width, height = img.size
                if width == height:
                    target_height = round(width * 9 / 16)
                    y_offset = round((height - target_height) / 2)
                    cropped = img.crop((0, y_offset, width, y_offset + target_height))
                    temp_path = filepath + ".tmp.png"
                    cropped.save(temp_path)
            
            if os.path.exists(filepath + ".tmp.png"):
                os.replace(filepath + ".tmp.png", filepath)
                print(f"Cropped {filename} to 16:9 ({width}x{target_height})")
        except Exception as e:
            print(f"Failed to process {filename}: {e}")

if __name__ == "__main__":
    main()
