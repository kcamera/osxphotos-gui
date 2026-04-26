#!/usr/bin/env python3
"""query_status.py — osxphotos library status helper for OSXPhotos Backup GUI."""

import argparse
import json
import sys
from datetime import datetime, timezone


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--library', help='Path to Photos library')
    parser.add_argument('--since', help='ISO 8601 datetime; count photos added after this')
    parser.add_argument('--from-date', dest='from_date', help='YYYY-MM-DD; only include photos on or after this date')
    parser.add_argument('--test-only', action='store_true',
                        help='Only test library access, do not count photos')
    args = parser.parse_args()

    try:
        from osxphotos import PhotosDB, QueryOptions
    except ImportError as e:
        print(json.dumps({'success': False, 'error': f'Import error: {e}'}))
        sys.exit(1)

    try:
        db = PhotosDB(dbfile=args.library) if args.library else PhotosDB()

        if args.test_only:
            # Just verifying we can open the library (TCC check)
            print(json.dumps({
                'success': True,
                'library_path': str(db.library_path),
                'photos_version': str(db.photos_version),
                'error': None,
            }))
            sys.exit(0)

        # Resolve from-date filter (matches osxphotos export --from-date behavior)
        from_date_obj = None
        if args.from_date:
            from_date_obj = datetime.fromisoformat(args.from_date).date()

        def after_from_date(p):
            if from_date_obj is None:
                return True
            return p.date is not None and p.date.date() >= from_date_obj

        # Load all assets once; exclude shared-album photos and apply date filter
        all_photos = [p for p in db.photos(images=True, movies=False) if not p.shared and after_from_date(p)]
        all_videos = [p for p in db.photos(images=False, movies=True) if not p.shared and after_from_date(p)]

        # Pending items: either all (first run) or added since last backup
        non_shared = all_photos + all_videos
        added_since = 0
        since_dt = None

        if args.since:
            since_dt = datetime.fromisoformat(args.since)
            if since_dt.tzinfo is None:
                since_dt = since_dt.replace(tzinfo=timezone.utc)
            try:
                opts = QueryOptions(added_after=since_dt)
                pending = [p for p in db.query(opts) if not p.shared and after_from_date(p)]
            except Exception:
                pending = [p for p in non_shared
                           if p.date_added and p.date_added.replace(tzinfo=timezone.utc) > since_dt]
            added_since = len(pending)
        else:
            # First run — everything in range is pending
            pending = non_shared

        pending_size_bytes = sum(p.original_filesize or 0 for p in pending)

        # iCloud downloads — only count items that are BOTH pending AND not on local disk.
        # These are the items osxphotos will actually fetch from iCloud during the next backup.
        pending_missing_count = sum(1 for p in pending if p.ismissing)

        result = {
            'success': True,
            'total_photos': len(all_photos),
            'total_videos': len(all_videos),
            'photos_added_since_date': added_since if args.since else None,
            'pending_size_bytes': pending_size_bytes,
            'pending_missing_count': pending_missing_count,
            'query_timestamp': datetime.now(timezone.utc).isoformat(),
            'library_path': str(db.library_path),
            'photos_version': str(db.photos_version),
            'error': None,
        }
        print(json.dumps(result))
        sys.exit(0)

    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))
        sys.exit(1)


if __name__ == '__main__':
    main()
