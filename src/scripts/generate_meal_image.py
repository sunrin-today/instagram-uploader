import io
import json
import sys
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from textfit import (
    MEAL_FONT_SIZE,
    MEAL_LINE_GAP,
    MEAL_MAX_CHARS,
    MEAL_MAX_CHARS_UPPER,
    MEAL_MAX_ITEMS,
    draw_items_from_bottom,
    limit_items,
)

ASSETS = Path(__file__).resolve().parent.parent / "assets"
WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"]


def loadfont(fontsize):
    return ImageFont.truetype(str(ASSETS / "fonts" / "Pretendard-Bold.ttf"), fontsize)


def school_meal(lst, date, weekday):
    W = 1024

    date_font = loadfont(36)
    date_font_color = "rgb(196, 196, 196)"

    image = Image.open(ASSETS / "images" / "food_background.png")
    draw = ImageDraw.Draw(image)

    parsed_day = date.split("-")
    text = f"{parsed_day[0]}년 {parsed_day[1]}월 {parsed_day[2]}일 {WEEKDAYS[weekday]}요일"
    draw.text((W - 392 - 90, 75), text, font=date_font, fill=date_font_color, align="right")

    meal_font_color = "rgb(71, 122, 255)"
    items = (
        ["급식이 없어요 ㅠㅠ"]
        if not lst
        else limit_items(
            lst,
            max_chars=MEAL_MAX_CHARS,
            max_chars_upper=MEAL_MAX_CHARS_UPPER,
            max_items=MEAL_MAX_ITEMS,
        )
    )
    draw_items_from_bottom(
        draw,
        items,
        font=loadfont(MEAL_FONT_SIZE),
        line_gap=MEAL_LINE_GAP,
        fill=meal_font_color,
    )

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
