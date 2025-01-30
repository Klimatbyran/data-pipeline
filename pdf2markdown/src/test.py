import json
from pathlib import Path
import jsonref

doc_id = "5ee1f2b6-a86a-4f26-86bc-2223c937528b"
out_dir = Path(f"/tmp/pdf2markdown/{doc_id}")


def without_keys(d: dict, keys: set):
    return {x: d[x] for x in d if x not in keys}


def main():
    with (out_dir / "parsed.json").open("r", encoding="utf-8") as fp:
        doc: dict = jsonref.load(fp)

    wanted_page_nums = {2, 8, 31, 32, 39, 40}
    print(sorted(wanted_page_nums))
    updated_pages = {}

    for page_no, page in doc["pages"].items():
        updated_pages[page_no] = (
            page if int(page_no) in wanted_page_nums else without_keys(page, {"image"})
        )

    doc["pages"] = updated_pages

    # NOTE: We might be able to de-reference the JSON file already in Python, which would be better since we then wouldn't require any new dependencies

    updated_json_path = out_dir / "filtered_images.json"

    # replace_refs returns a copy of the document with refs replaced by JsonRef
    # objects. It will resolve refences to other JSON schema files
    doc_export = jsonref.replace_refs(doc, lazy_load=True, proxies=False)
    print(updated_json_path)

    with updated_json_path.open("w", encoding="utf-8") as fp:
        jsonref.dump(doc_export, fp)


main()
