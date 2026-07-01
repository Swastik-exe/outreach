"""Helpers for verify scripts — paginated API responses return {content: [...]}."""
import json
import sys


def page_items(data):
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and "content" in data:
        return data["content"]
    return []


def main():
    raw = json.load(sys.stdin)
    data = raw.get("data")
    items = page_items(data)
    if len(sys.argv) > 1 and sys.argv[1] == "len":
        print(len(items))
    else:
        print(json.dumps(items))


if __name__ == "__main__":
    main()
