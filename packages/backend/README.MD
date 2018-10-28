* verify that you are using node version 8.1.2. Other versions probably work, but are unsupported.
    - If you change node version while developing, you will need to rebuild opencv (takes a while).
* `npm install --global windows-build-tools` in elevated console
* `npm install` (will take some time to build opencv!)
* get Python 3.5.4 (source: https://www.python.org/downloads/release/python-354/)
* do `pip3 install --upgrade tensorflow-gpu`
* install nvidia CUDA 9.0: https://developer.nvidia.com/cuda-90-download-archive?target_os=Windows&target_arch=x86_64&target_version=10&target_type=exenetwork
* Download cuDNN v7.0.5 (Dec 5, 2017), for CUDA 9.0: https://developer.nvidia.com/rdp/cudnn-download#a-collapse705-9 (Membership required)
* Make sure all relevant DLL's are in the windows `PATH`. For simplicity, run the next step to see what DLL's are missing from the path.
* run `python3 retrain.py --image_dir ./ball_images` or just `python` if `python --version` returns `3.5.x`