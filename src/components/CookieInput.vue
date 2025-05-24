<template>
  <el-dialog
    v-model="dialogVisible"
    :title="t('cookie.title')"
    width="500px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
    class="cookie-input-dialog"
  >
    <el-form :model="form" label-width="120px">
      <el-form-item :label="t('cookie.inputLabel')">
        <el-input
          v-model="form.cookie"
          type="text"
          :placeholder="t('cookie.placeholder')"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <span class="dialog-footer">
        <el-button type="primary" @click="handleSubmit">
          {{ t('cookie.submit') }}
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import { useCookieStore } from '../stores/cookieStore';
import { ElMessage } from 'element-plus';

const { t } = useI18n();
const cookieStore = useCookieStore();

const dialogVisible = ref(true);
const form = reactive({
  cookie: ''
});

const handleSubmit = async () => {
  if (!form.cookie) {
    ElMessage.error(t('cookie.emptyError'));
    return;
  }

  const success = await cookieStore.setCookieToBackend(form.cookie);
  if (success) {
    ElMessage.success(t('cookie.success'));
    dialogVisible.value = false;
  } else {
    ElMessage.error(t('cookie.error'));
  }
};
</script>

<style scoped>
.dialog-footer {
  display: flex;
  justify-content: flex-end;
}

:deep(.cookie-input-dialog) {
  background-color: var(--el-bg-color);
}

:deep(.cookie-input-dialog .el-dialog__title) {
  color: var(--el-text-color-primary);
}

:deep(.cookie-input-dialog .el-form-item__label) {
  color: var(--el-text-color-regular);
}

:deep(.cookie-input-dialog .el-input__inner) {
  background-color: var(--el-bg-color);
  color: var(--el-text-color-primary);
  border-color: var(--el-border-color-light);
}

:deep(.cookie-input-dialog .el-input__inner::placeholder) {
  color: var(--el-text-color-regular);
}
</style> 