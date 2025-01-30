import logging
import json
import sys
import os
from argparse import ArgumentParser
from io import BytesIO
from pathlib import Path
from jsonref import replace_refs

from docling.datamodel.document import ConversionResult, DoclingDocument
from docling.datamodel.base_models import InputFormat, ConversionStatus
from docling.datamodel.pipeline_options import PdfPipelineOptions, TableFormerMode
from docling.document_converter import (
    DocumentConverter,
    PdfFormatOption,
    DocumentStream,
)
from docling.models.tesseract_ocr_model import TesseractOcrOptions

_log = logging.getLogger("parse_pdf")


def flatten(matrix):
    flat_list = []
    for row in matrix:
        flat_list.extend(row)
    return flat_list


def without_keys(d: dict, keys: set):
    return {x: d[x] for x in d if x not in keys}


def export_document(
    conv_result: ConversionResult,
    output_dir: Path,
):
    output_dir.mkdir(parents=True, exist_ok=True)

    if conv_result.status == ConversionStatus.SUCCESS:
        markdown_file = output_dir / "parsed.md"
        json_file = output_dir / "parsed.json"

        with markdown_file.open("w", encoding="utf-8") as fp:
            fp.write(conv_result.document.export_to_markdown(image_placeholder=""))
            _log.info(f"Saved document Markdown to: {markdown_file}")

        unique_pages_with_tables = set(
            flatten(
                [
                    [item.page_no for item in table.prov]
                    for table in conv_result.document.tables
                ]
            )
        )

        _log.info(
            f"Found {len(unique_pages_with_tables)} unique pages with tables: {sorted(unique_pages_with_tables)}"
        )

        # IDEA: We could perhaps export the markdown for each table, and pass this as context for the Vision API along with the page screenshot
        # Or, since we use the page image when parsing with the Vision API, we should likely convert the whole page text content to markdown.
        # Because then the page would match the image content, which might yield better (or worse) results. Worth experimenting with.
        # Export tables
        # for table_ix, table in enumerate(conv_res.document.tables):
        #     table_df: pd.DataFrame = table.export_to_dataframe()
        #     print(f"## Table {table_ix}")
        #     print(table_df.to_markdown())

        doc_export: DoclingDocument = conv_result.document.export_to_dict()
        updated_pages = {}

        # Page screenshots are already part of the `doc_export`
        # However, we only want to keep page images where tables were found
        for page_no, page in doc_export["pages"].items():
            updated_pages[page_no] = (
                page
                if int(page_no) in unique_pages_with_tables
                else without_keys(page, {"image"})
            )

        doc_export["pages"] = updated_pages

        # TODO: Figure out if we could remove refs from the exported document to make it easier to work with during later steps
        # Ideally, we solve this on the Python side where we have much better context compared to with Node.js
        # Also, if we can solve it with Python, we don't need to install additional dependencies, since `jsonref` is already a dependency of Docling
        # replace_refs returns a copy of the document with refs replaced by JsonRef
        # objects. It will resolve refences to other JSON schema files
        # doc = replace_refs(
        #     doc_export,
        #     merge_props=True,
        #     base_uri=json_file.absolute().as_uri(),
        # )

        # IDEA: Maybe we could speed up the parsing if we only take page screenshots after we know the relevant pages.
        # This would reduce both CPU and memory usage since we throw away the pages anyway.
        # IDEA: Either we could take screenshots using some python library.
        # Or, perhaps we could create a new document converter, but for the second time use new conversion options to also take screenshots of the selected pages
        # And if we only do it for the selected pages, then we get only the data we need.

        with json_file.open("w", encoding="utf-8") as fp:
            json.dump(doc_export, fp, ensure_ascii=False)
            _log.info(
                f"Saved document JSON (including Base64-encoded page images) to: {json_file}"
            )

    elif conv_result.status == ConversionStatus.PARTIAL_SUCCESS:
        _log.info(
            f"Document {conv_result.input.file} was partially converted with the following errors:"
        )
        for item in conv_result.errors:
            _log.info(f"\t{item.error_message}")
    else:
        _log.info(f"Document {conv_result.input.file} failed to convert.")


def parse_document(input_file: Path, output_dir: Path):
    if not os.path.exists(input_file):
        raise Exception(f"Input PDF does not exist: {input_file}")

    _log.info(f"Parsing {input_file} with Docling and Tesseract...")

    pipeline_options = PdfPipelineOptions()
    pipeline_options.do_ocr = True
    pipeline_options.do_table_structure = True
    pipeline_options.table_structure_options.do_cell_matching = True
    # TODO: decide between ACCURATE and FAST modes
    # with accurate parsing: 108 tables on 42 unique pages - 300 seconds => 5 min
    # with fast parsing:	 108 tables on 42 unique pages - 175 seconds => 3 min
    pipeline_options.table_structure_options.mode = TableFormerMode.FAST
    pipeline_options.ocr_options = TesseractOcrOptions()
    pipeline_options.ocr_options.lang = ["swe", "eng"]
    pipeline_options.generate_page_images = True
    pipeline_options.images_scale = 3

    doc_converter = DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
        }
    )

    buf = BytesIO(input_file.open("rb").read())
    input_stream = DocumentStream(name=input_file.name, stream=buf)

    conv_result = doc_converter.convert(input_stream, raises_on_error=False)
    export_document(conv_result, output_dir)


def main():
    logging.basicConfig(level=logging.INFO)

    arg_parser = ArgumentParser(prog="parse_pdf", description="Parse a PDF")
    arg_parser.add_argument("inputPDF", help="Path to the input PDF document")
    arg_parser.add_argument(
        "outDir",
        help="Path to the output directory for results to the current document",
    )
    parsed_args = arg_parser.parse_args(sys.argv[1:])

    parse_document(Path(parsed_args.inputPDF), Path(parsed_args.outDir))


if __name__ == "__main__":
    main()
