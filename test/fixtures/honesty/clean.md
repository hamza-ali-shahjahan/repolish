# tablo

Render pandas DataFrames as crisp terminal tables.

## Why

tablo keeps output readable on narrow terminals without truncating the columns
that matter.

## Quick start

```bash
pip install tablo
```

## Testing

Run the suite with `pytest`. CI runs on Linux, macOS, and Windows on every push.

## Performance

Rendering is fast enough for interactive use; reproducible numbers live in `bench/`.

## Dependencies

tablo depends on `rich` and `pandas`.

## Status

Used in a couple of our internal tools so far; expect some rough edges and please
file issues.

## License

Apache-2.0
