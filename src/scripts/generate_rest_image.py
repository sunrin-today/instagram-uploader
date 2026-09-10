import io
import json
import sys
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from textfit import (
    REST_FONT_SIZE,
    REST_LINE_GAP,
    REST_MAX_CHARS,
    REST_MAX_CHARS_UPPER,
    REST_MAX_ITEMS,
    draw_items_from_bottom,
    limit_items,
)

ASSETS = Path(__file__).resolve().parent.parent / "assets"
WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"]


def loadfont(fontsize):
    return ImageFont.truetype(str(ASSETS / "fonts" / "Pretendard-Bold.ttf"), fontsize)


def rest(lst, date, is_empty):
    W = 1024

    date_font = loadfont(36)
    date_font_color = "rgb(196, 196, 196)"

    image = Image.open(ASSETS / "images" / "rest_background.png")
    draw = ImageDraw.Draw(image)

    parsed_day = date.split("-")
    text = f"{parsed_day[0]}년 {parsed_day[1]}월"
    draw.text((W - 290, 75), text, font=date_font, fill=date_font_color, align="right")

    rest_font_color = "rgb(234, 92,81)"

    if is_empty:
        items = ["휴일이 없어요 ㅠㅠ"]
    else:
        items = []
        for item in lst:
            weekday = WEEKDAYS[datetime.strptime(item["date"], "%Y-%m-%d").weekday()]
            day_number = int(item["date"].split("-")[2])
            content = item["content"]
            items.append(f"{day_number}일 ({weekday}) - {content}")

    if not is_empty:
        items = limit_items(
            items,
            max_chars=REST_MAX_CHARS,
            max_chars_upper=REST_MAX_CHARS_UPPER,
            max_items=REST_MAX_ITEMS,
        )

    draw_items_from_bottom(
        draw,
        items,
        font=loadfont(REST_FONT_SIZE),
        line_gap=REST_LINE_GAP,
        fill=rest_font_color,
    )

    return image.convert("RGB")


def main():
    payload = json.load(sys.stdin)
    date = payload["date"]
    items = payload.get("items") or []

    image = rest(items, date, len(items) == 0)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=95)
    sys.stdout.buffer.write(buffer.getvalue())


if __name__ == "__main__":
    main()
