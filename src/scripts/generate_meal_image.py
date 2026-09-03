import io
import json
import sys
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ASSETS = Path(__file__).resolve().parent.parent / "assets"
WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"]


def loadfont(fontsize):
    return ImageFont.truetype(str(ASSETS / "fonts" / "Pretendard-Bold.ttf"), fontsize)


def school_meal(lst, date, weekday):
    W = 1024
    H = 1024

    lst = list(reversed(lst))

    date_font = loadfont(36)
    date_font_color = "rgb(196, 196, 196)"

    image = Image.open(ASSETS / "images" / "food_background.png")
    draw = ImageDraw.Draw(image)

    parsed_day = date.split("-")
    text = f"{parsed_day[0]}년 {parsed_day[1]}월 {parsed_day[2]}일 {WEEKDAYS[weekday]}요일"
    draw.text((W - 392 - 90, 75), text, font=date_font, fill=date_font_color, align="right")

    meal_font = loadfont(70)
    meal_font_color = "rgb(71, 122, 255)"

    text_l = 70

    if len(lst) == 0:
        draw.text((75, H - 75 - text_l), "급식이 없어요 ㅠㅠ", font=meal_font, fill=meal_font_color)
    else:
        for l in lst:
            draw.text((75, H - 75 - text_l), l, font=meal_font, fill=meal_font_color)
            text_l += 85

    return image.convert("RGB")


def main():
    payload = json.load(sys.stdin)
    date = payload["date"]
    meals = payload.get("meals") or []
    weekday = datetime.strptime(date, "%Y-%m-%d").weekday()

    image = school_meal(meals, date, weekday)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=95)
    sys.stdout.buffer.write(buffer.getvalue())


if __name__ == "__main__":
    main()
