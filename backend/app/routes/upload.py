from typing import List, Optional
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from ..security import current_user
from ..file_extractor import process_uploaded_file

router = APIRouter(prefix="/api", tags=["upload"])


@router.post("/upload")
async def upload(
    files: Optional[List[UploadFile]] = File(default=None),
    files_bracket: Optional[List[UploadFile]] = File(default=None, alias="files[]"),
    user=Depends(current_user),
):
    upload_list = files or files_bracket
    if not upload_list:
        raise HTTPException(400, "No files provided in request.")

    if len(upload_list) > 10:
        raise HTTPException(400, "Maximum 10 files per upload allowed.")

    results = []
    for f in upload_list:
        contents = await f.read()
        res = process_uploaded_file(contents, f.filename or "unknown")
        results.append(res)

    return results
