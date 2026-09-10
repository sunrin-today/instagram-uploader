LEFT = 75
BOTTOM = 90
CANVAS = 1024

MEAL_FONT_SIZE = 56
MEAL_LINE_GAP = 72
MEAL_MAX_CHARS = 14
MEAL_MAX_CHARS_UPPER = 18
MEAL_MAX_ITEMS = 10

REST_FONT_SIZE = 48
REST_LINE_GAP = 62
REST_MAX_CHARS = 19
REST_MAX_CHARS_UPPER = 24
REST_MAX_ITEMS = 9


def limit_text(text, max_chars):
    text = "" if text is None else str(text)
    if len(text) <= max_chars:
        return text
    if max_chars <= 1:
        return "…"
    return text[: max_chars - 1] + "…"


def limit_items(texts, *, max_chars, max_items, max_chars_upper=None):
    if max_chars_upper is None:
        max_chars_upper = max_chars

    if len(texts) <= max_items:
        items = list(texts)
    else:
        shown = max(1, max_items - 1)
        extra = len(texts) - shown
        items = list(texts[:shown]) + [f"외 {extra}개"]

    if not items:
        return []
    if len(items) == 1:
        return [limit_text(items[0], max_chars)]
    return [
        *[limit_text(text, max_chars_upper) for text in items[:-1]],
        limit_text(items[-1], max_chars),
    ]


def draw_items_from_bottom(draw, texts, *, font, line_gap, fill):
    offset = BOTTOM
    for text in reversed(texts):
        draw.text((LEFT, CANVAS - offset - line_gap), text, font=font, fill=fill)
        offset += line_gap
