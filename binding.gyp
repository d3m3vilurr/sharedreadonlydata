{
  "targets": [
    {
      "include_dirs": [ "<!(node -e \"require('nan')\")" ],
      "target_name": "readonlytemplate",
      "sources": [ "src/readonlytemplate.cc" ]
    }
  ]
}
